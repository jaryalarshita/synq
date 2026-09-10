import { buildLatencyHistogram } from '../../engine/telemetry'
import type { RequestLogEntry } from '../../store/useSynqStore'

interface LatencyHistogramProps {
  entries: RequestLogEntry[]
}

export default function LatencyHistogram({ entries }: LatencyHistogramProps) {
  const buckets = buildLatencyHistogram(entries)
  const peak = Math.max(1, ...buckets.map((b) => b.count))

  return (
    <div className="glass-card chart-card">
      <div className="panel-section-title">Latency Distribution</div>

      <div className="histogram" role="img" aria-label="Latency distribution histogram">
        {buckets.map((bucket) => {
          const heightPct = (bucket.count / peak) * 100
          return (
            <div className="histogram-column" key={bucket.label}>
              <div className="histogram-bar-track">
                <div
                  className="histogram-bar"
                  style={{ height: `${heightPct}%` }}
                  title={`${bucket.count} request${bucket.count === 1 ? '' : 's'} in ${bucket.label} ms`}
                />
              </div>
              <span className="histogram-count">{bucket.count || ''}</span>
              <span className="histogram-label">{bucket.label}</span>
            </div>
          )
        })}
      </div>
      <div className="chart-axis-caption">Response time (ms)</div>
    </div>
  )
}
