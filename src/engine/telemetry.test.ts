import { describe, it, expect } from 'vitest'
import {
  buildLatencyHistogram,
  buildStatusBreakdown,
  buildThroughputSeries,
  percentile,
  summarize
} from './telemetry'
import type { RequestLogEntry } from '../store/useSynqStore'

let seq = 0
function entry(overrides: Partial<RequestLogEntry> = {}): RequestLogEntry {
  seq++
  return {
    id: `r${seq}`,
    timestamp: 1_000_000 + seq,
    method: 'GET',
    path: '/api/users',
    status: 200,
    timeMs: 100,
    injected: false,
    ...overrides
  }
}

describe('buildLatencyHistogram', () => {
  it('returns a stable set of bands even with no data', () => {
    const buckets = buildLatencyHistogram([])

    expect(buckets).toHaveLength(7)
    expect(buckets[0].label).toBe('0-50')
    expect(buckets.at(-1)?.label).toBe('2500+')
    expect(buckets.every((b) => b.count === 0)).toBe(true)
  })

  it('places each duration in the band whose upper bound it falls under', () => {
    const buckets = buildLatencyHistogram([
      entry({ timeMs: 0 }),
      entry({ timeMs: 49 }),
      entry({ timeMs: 50 }), // boundary belongs to the next band up
      entry({ timeMs: 260 }),
      entry({ timeMs: 9000 })
    ])

    expect(buckets[0].count).toBe(2) // 0 and 49
    expect(buckets[1].count).toBe(1) // 50
    expect(buckets[3].count).toBe(1) // 260 -> 250-500
    expect(buckets.at(-1)?.count).toBe(1) // 9000 -> overflow
  })

  it('counts every entry exactly once', () => {
    const entries = Array.from({ length: 50 }, (_, i) => entry({ timeMs: i * 97 }))

    const total = buildLatencyHistogram(entries).reduce((sum, b) => sum + b.count, 0)

    expect(total).toBe(50)
  })
})

describe('buildStatusBreakdown', () => {
  it('groups statuses into families with their share of the total', () => {
    const groups = buildStatusBreakdown([
      entry({ status: 200 }),
      entry({ status: 201 }),
      entry({ status: 404 }),
      entry({ status: 500 })
    ])

    expect(groups[0]).toMatchObject({ family: '2xx', count: 2, share: 0.5 })
    expect(groups.map((g) => g.family).sort()).toEqual(['2xx', '4xx', '5xx'])
  })

  it('orders families by descending count', () => {
    const groups = buildStatusBreakdown([
      entry({ status: 200 }),
      entry({ status: 500 }),
      entry({ status: 500 }),
      entry({ status: 500 })
    ])

    expect(groups[0].family).toBe('5xx')
    expect(groups[0].count).toBe(3)
  })

  it('returns nothing for an empty log', () => {
    expect(buildStatusBreakdown([])).toEqual([])
  })
})

describe('buildThroughputSeries', () => {
  it('returns nothing for an empty log', () => {
    expect(buildThroughputSeries([])).toEqual([])
  })

  it('spreads entries across the requested number of buckets', () => {
    const entries = Array.from({ length: 10 }, (_, i) =>
      entry({ timestamp: 1000 + i * 100 })
    )

    const points = buildThroughputSeries(entries, 5)

    expect(points).toHaveLength(5)
    expect(points.reduce((sum, p) => sum + p.count, 0)).toBe(10)
  })

  it('keeps a single entry in one populated bucket', () => {
    const points = buildThroughputSeries([entry({ timestamp: 5000 })], 4)

    expect(points.reduce((sum, p) => sum + p.count, 0)).toBe(1)
  })

  it('handles many entries sharing one timestamp without dividing by zero', () => {
    const entries = Array.from({ length: 5 }, () => entry({ timestamp: 42 }))

    const points = buildThroughputSeries(entries, 10)

    expect(points.reduce((sum, p) => sum + p.count, 0)).toBe(5)
    expect(points.every((p) => Number.isFinite(p.time))).toBe(true)
  })
})

describe('percentile', () => {
  it('returns 0 for no samples', () => {
    expect(percentile([], 95)).toBe(0)
  })

  it('finds the nearest-rank value', () => {
    const values = [10, 20, 30, 40, 50, 60, 70, 80, 90, 100]

    expect(percentile(values, 100)).toBe(100)
    expect(percentile(values, 50)).toBe(50)
    expect(percentile(values, 95)).toBe(100)
  })

  it('does not care about input order', () => {
    expect(percentile([50, 10, 30], 50)).toBe(30)
  })
})

describe('summarize', () => {
  it('reports zeroes for an empty log rather than NaN', () => {
    const summary = summarize([])

    expect(summary.total).toBe(0)
    expect(summary.avgLatency).toBe(0)
    expect(summary.successRate).toBe(0)
    expect(Number.isNaN(summary.p95Latency)).toBe(false)
  })

  it('splits successes from errors and averages the latency', () => {
    const summary = summarize([
      entry({ status: 200, timeMs: 100 }),
      entry({ status: 201, timeMs: 200 }),
      entry({ status: 500, timeMs: 300, injected: true })
    ])

    expect(summary.total).toBe(3)
    expect(summary.successCount).toBe(2)
    expect(summary.errorCount).toBe(1)
    expect(summary.injectedCount).toBe(1)
    expect(summary.successRate).toBeCloseTo(2 / 3, 5)
    expect(summary.avgLatency).toBe(200)
    expect(summary.minLatency).toBe(100)
    expect(summary.maxLatency).toBe(300)
  })

  it('counts only 2xx as success, so a 3xx is an error here', () => {
    const summary = summarize([entry({ status: 301 })])

    expect(summary.successCount).toBe(0)
    expect(summary.errorCount).toBe(1)
  })
})
