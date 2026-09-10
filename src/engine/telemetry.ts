import type { RequestLogEntry } from '../store/useSynqStore'

/**
 * Aggregation helpers for the observability dashboard. Kept separate from the
 * components so the bucketing/percentile maths can be unit tested directly.
 */

export interface HistogramBucket {
  /** Inclusive lower bound in ms. */
  from: number
  /** Exclusive upper bound in ms, or null for the overflow bucket. */
  to: number | null
  label: string
  count: number
}

export interface StatusGroup {
  /** '2xx' | '4xx' | '5xx' style family label. */
  family: string
  count: number
  share: number
}

export interface ThroughputPoint {
  /** Start of the bucket, as a epoch-ms timestamp. */
  time: number
  count: number
}

export interface TelemetrySummary {
  total: number
  successCount: number
  errorCount: number
  injectedCount: number
  successRate: number
  avgLatency: number
  p95Latency: number
  minLatency: number
  maxLatency: number
}

/** Upper bounds (ms) for the latency histogram; the last bucket is unbounded. */
const LATENCY_BOUNDS = [50, 100, 250, 500, 1000, 2500]

/**
 * Buckets request durations into fixed latency bands. Fixed bands (rather than
 * bands derived from the data) keep the chart's x-axis stable as requests come
 * in, so the shape can be compared across runs.
 */
export function buildLatencyHistogram(entries: RequestLogEntry[]): HistogramBucket[] {
  const buckets: HistogramBucket[] = []

  let lower = 0
  for (const bound of LATENCY_BOUNDS) {
    buckets.push({ from: lower, to: bound, label: `${lower}-${bound}`, count: 0 })
    lower = bound
  }
  buckets.push({ from: lower, to: null, label: `${lower}+`, count: 0 })

  for (const entry of entries) {
    const index = LATENCY_BOUNDS.findIndex((bound) => entry.timeMs < bound)
    buckets[index === -1 ? buckets.length - 1 : index].count++
  }

  return buckets
}

/**
 * Groups responses by status family (2xx/4xx/5xx...), ordered by descending
 * count so the dominant outcome reads first.
 */
export function buildStatusBreakdown(entries: RequestLogEntry[]): StatusGroup[] {
  const counts = new Map<string, number>()

  for (const entry of entries) {
    const family = `${Math.floor(entry.status / 100)}xx`
    counts.set(family, (counts.get(family) || 0) + 1)
  }

  const total = entries.length
  return Array.from(counts.entries())
    .map(([family, count]) => ({
      family,
      count,
      share: total === 0 ? 0 : count / total
    }))
    .sort((a, b) => b.count - a.count || a.family.localeCompare(b.family))
}

/**
 * Counts requests per time bucket for the throughput chart. Buckets span the
 * window from the first to the last entry, so a short burst doesn't get
 * flattened into a single column.
 */
export function buildThroughputSeries(
  entries: RequestLogEntry[],
  bucketCount = 20
): ThroughputPoint[] {
  if (entries.length === 0 || bucketCount <= 0) return []

  const times = entries.map((e) => e.timestamp)
  const start = Math.min(...times)
  const end = Math.max(...times)
  // A single instant (or one entry) still deserves one populated bucket.
  const span = Math.max(1, end - start)
  const bucketSize = span / bucketCount

  const points: ThroughputPoint[] = Array.from({ length: bucketCount }, (_, i) => ({
    time: start + i * bucketSize,
    count: 0
  }))

  for (const entry of entries) {
    const index = Math.min(bucketCount - 1, Math.floor((entry.timestamp - start) / bucketSize))
    points[index].count++
  }

  return points
}

/** Nearest-rank percentile over an unsorted list of durations. */
export function percentile(values: number[], p: number): number {
  if (values.length === 0) return 0

  const sorted = [...values].sort((a, b) => a - b)
  const rank = Math.ceil((p / 100) * sorted.length)
  return sorted[Math.min(sorted.length - 1, Math.max(0, rank - 1))]
}

/** Headline numbers shown above the charts. */
export function summarize(entries: RequestLogEntry[]): TelemetrySummary {
  const total = entries.length
  if (total === 0) {
    return {
      total: 0,
      successCount: 0,
      errorCount: 0,
      injectedCount: 0,
      successRate: 0,
      avgLatency: 0,
      p95Latency: 0,
      minLatency: 0,
      maxLatency: 0
    }
  }

  const latencies = entries.map((e) => e.timeMs)
  const successCount = entries.filter((e) => e.status >= 200 && e.status < 300).length

  return {
    total,
    successCount,
    errorCount: total - successCount,
    injectedCount: entries.filter((e) => e.injected).length,
    successRate: successCount / total,
    avgLatency: latencies.reduce((sum, v) => sum + v, 0) / total,
    p95Latency: percentile(latencies, 95),
    minLatency: Math.min(...latencies),
    maxLatency: Math.max(...latencies)
  }
}
