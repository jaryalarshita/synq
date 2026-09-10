import { buildStatusBreakdown } from '../../engine/telemetry'
import type { RequestLogEntry } from '../../store/useSynqStore'

interface StatusBreakdownProps {
  entries: RequestLogEntry[]
}

/** Family -> css modifier, so 2xx/4xx/5xx read differently at a glance. */
function familyClass(family: string): string {
  if (family.startsWith('2')) return 'status-family-success'
  if (family.startsWith('4')) return 'status-family-client'
  if (family.startsWith('5')) return 'status-family-server'
  return 'status-family-other'
}

export default function StatusBreakdown({ entries }: StatusBreakdownProps) {
  const groups = buildStatusBreakdown(entries)

  return (
    <div className="glass-card chart-card">
      <div className="panel-section-title">Status Codes</div>

      {groups.length === 0 ? (
        <p className="chart-empty-note">No responses recorded yet.</p>
      ) : (
        <>
          {/* Single stacked bar: proportions are easier to compare than a pie */}
          <div className="status-stack" role="img" aria-label="Status code breakdown">
            {groups.map((group) => (
              <div
                key={group.family}
                className={`status-stack-segment ${familyClass(group.family)}`}
                style={{ width: `${group.share * 100}%` }}
                title={`${group.family}: ${group.count} (${Math.round(group.share * 100)}%)`}
              />
            ))}
          </div>

          <ul className="status-legend">
            {groups.map((group) => (
              <li key={group.family}>
                <span className={`status-legend-swatch ${familyClass(group.family)}`} />
                <span className="status-legend-family">{group.family}</span>
                <span className="status-legend-count">
                  {group.count} · {Math.round(group.share * 100)}%
                </span>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  )
}
