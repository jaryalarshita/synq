import { buildThroughputSeries } from '../../engine/telemetry'
import type { RequestLogEntry } from '../../store/useSynqStore'

interface ThroughputChartProps {
  entries: RequestLogEntry[]
}

// The SVG uses a fixed viewBox and scales to its container, so no resize
// observer or measurement is needed.
const VIEW_WIDTH = 300
const VIEW_HEIGHT = 80

export default function ThroughputChart({ entries }: ThroughputChartProps) {
  const points = buildThroughputSeries(entries, 24)
  const peak = Math.max(1, ...points.map((p) => p.count))

  // Map each bucket to viewBox coordinates (y is inverted in SVG).
  const coords = points.map((point, i) => {
    const x = points.length === 1 ? VIEW_WIDTH / 2 : (i / (points.length - 1)) * VIEW_WIDTH
    const y = VIEW_HEIGHT - (point.count / peak) * VIEW_HEIGHT
    return { x, y }
  })

  const linePath = coords.map((c, i) => `${i === 0 ? 'M' : 'L'}${c.x},${c.y}`).join(' ')
  // Close the path along the baseline to shade the area under the line.
  const areaPath = coords.length
    ? `${linePath} L${coords.at(-1)!.x},${VIEW_HEIGHT} L${coords[0].x},${VIEW_HEIGHT} Z`
    : ''

  return (
    <div className="glass-card chart-card">
      <div className="panel-section-title">Request Throughput</div>

      {points.length === 0 ? (
        <p className="chart-empty-note">No requests recorded yet.</p>
      ) : (
        <>
          <svg
            className="throughput-svg"
            viewBox={`0 0 ${VIEW_WIDTH} ${VIEW_HEIGHT}`}
            preserveAspectRatio="none"
            role="img"
            aria-label={`Request throughput over time, peaking at ${peak} per interval`}
          >
            <path className="throughput-area" d={areaPath} />
            <path className="throughput-line" d={linePath} vectorEffect="non-scaling-stroke" />
          </svg>
          <div className="chart-axis-caption">
            <span>oldest</span>
            <span>peak {peak}/interval</span>
            <span>newest</span>
          </div>
        </>
      )}
    </div>
  )
}
