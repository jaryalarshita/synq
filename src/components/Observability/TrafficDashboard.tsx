import { Activity, Trash2 } from 'lucide-react'
import { useSynqStore } from '../../store/useSynqStore'
import { summarize } from '../../engine/telemetry'
import ThroughputChart from './ThroughputChart'
import LatencyHistogram from './LatencyHistogram'
import StatusBreakdown from './StatusBreakdown'

export default function TrafficDashboard() {
  const { requestLog, clearRequestLog } = useSynqStore()
  const summary = summarize(requestLog)

  if (requestLog.length === 0) {
    return (
      <div className="tab-pane">
        <div className="pane-header">
          <div>
            <h2>Observability</h2>
            <p className="subtitle">Live traffic, latency, and status telemetry for your mock API.</p>
          </div>
        </div>
        <div className="empty-state">
          <div className="empty-icon-wrapper">
            <Activity size={32} className="empty-icon" />
          </div>
          <h3>No Traffic Recorded</h3>
          <p>
            Send some requests from the API Mock Sandbox and they will show up here. Turn on Chaos
            Studio first to see failures and slow responses in the charts.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="tab-pane">
      <div className="pane-header">
        <div>
          <h2>Observability</h2>
          <p className="subtitle">Live traffic, latency, and status telemetry for your mock API.</p>
        </div>
        <button className="btn btn-secondary" onClick={clearRequestLog} title="Clear telemetry">
          <Trash2 size={16} />
          <span>Clear</span>
        </button>
      </div>

      {/* Headline numbers */}
      <div className="telemetry-stats">
        <div className="glass-card stat-tile">
          <span className="stat-label">Requests</span>
          <span className="stat-value">{summary.total}</span>
        </div>
        <div className="glass-card stat-tile">
          <span className="stat-label">Success Rate</span>
          <span className="stat-value">{Math.round(summary.successRate * 100)}%</span>
          <span className="stat-sub">{summary.errorCount} failed</span>
        </div>
        <div className="glass-card stat-tile">
          <span className="stat-label">Avg Latency</span>
          <span className="stat-value">{Math.round(summary.avgLatency)} ms</span>
          <span className="stat-sub">
            {summary.minLatency}–{summary.maxLatency} ms
          </span>
        </div>
        <div className="glass-card stat-tile">
          <span className="stat-label">p95 Latency</span>
          <span className="stat-value">{summary.p95Latency} ms</span>
        </div>
        <div className="glass-card stat-tile">
          <span className="stat-label">Chaos Injected</span>
          <span className="stat-value">{summary.injectedCount}</span>
        </div>
      </div>

      <div className="telemetry-charts">
        <ThroughputChart entries={requestLog} />
        <LatencyHistogram entries={requestLog} />
        <StatusBreakdown entries={requestLog} />
      </div>
    </div>
  )
}
