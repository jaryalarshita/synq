import { useState } from 'react'
import { Zap, ChevronDown, ChevronRight, RotateCcw } from 'lucide-react'
import { useSynqStore, MAX_CHAOS_LATENCY_MS } from '../../store/useSynqStore'
import type { ChaosErrorStatus } from '../../store/useSynqStore'

const ERROR_STATUSES: { status: ChaosErrorStatus; label: string }[] = [
  { status: 500, label: 'Internal Server Error' },
  { status: 429, label: 'Rate Limited' },
  { status: 404, label: 'Not Found' }
]


interface ValueFieldProps {
  id: string
  value: number
  min: number
  max: number
  unit: string
  disabled: boolean
  onCommit: (value: number) => void
}

/**
 * Numeric entry paired with a slider, for setting an exact value without
 * dragging. Edits are held locally and committed on Enter or blur, so a
 * half-typed number ("10" on the way to "1000") isn't clamped mid-keystroke.
 */
function ValueField({ id, value, min, max, unit, disabled, onCommit }: ValueFieldProps) {
  const [draft, setDraft] = useState(String(value))

  // Re-sync when the value changes elsewhere (slider drag, reset, clamping).
  const [lastValue, setLastValue] = useState(value)
  if (value !== lastValue) {
    setLastValue(value)
    setDraft(String(value))
  }

  const commit = () => {
    const parsed = Number(draft)
    if (draft.trim() === '' || Number.isNaN(parsed)) {
      setDraft(String(value)) // revert an unusable entry
      return
    }
    onCommit(parsed)
  }

  return (
    <div className="chaos-value-field">
      <input
        id={id}
        type="number"
        className="chaos-value-input"
        min={min}
        max={max}
        value={draft}
        disabled={disabled}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault()
            commit()
          }
        }}
      />
      <span className="chaos-value-unit">{unit}</span>
    </div>
  )
}

export default function ChaosPanel() {
  const { chaosConfig, updateChaosConfig, resetChaosConfig } = useSynqStore()
  const [isExpanded, setIsExpanded] = useState(false)

  const { enabled, latencyMin, latencyMax, errorRates } = chaosConfig

  // Rates are laid end to end by the engine, so the combined failure chance is
  // their sum, capped at 100%.
  const totalErrorRate = Math.min(
    100,
    ERROR_STATUSES.reduce((sum, { status }) => sum + errorRates[status], 0)
  )

  return (
    <div className="glass-card chaos-panel">
      <div className="chaos-header">
        <button
          type="button"
          className="chaos-collapse-btn"
          onClick={() => setIsExpanded((prev) => !prev)}
          aria-expanded={isExpanded}
        >
          {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
          <Zap size={14} className={enabled ? 'chaos-icon-active' : ''} />
          <span>Chaos Studio</span>
        </button>

        <div className="chaos-header-meta">
          {enabled && (
            <span className="chaos-summary-badge">
              {latencyMin}–{latencyMax} ms · {totalErrorRate}% fail
            </span>
          )}
          <label className="chaos-switch">
            <input
              type="checkbox"
              checked={enabled}
              onChange={(e) => updateChaosConfig({ enabled: e.target.checked })}
            />
            <span className="chaos-switch-track" aria-hidden="true" />
            <span className="chaos-switch-label">{enabled ? 'On' : 'Off'}</span>
          </label>
        </div>
      </div>

      {isExpanded && (
        <div className="chaos-body animate-fadeIn">
          <p className="chaos-hint">
            Injected faults short-circuit the request before routing, so a simulated failure never
            touches your generated data.
          </p>

          <div className="chaos-section">
            <div className="chaos-section-title">Latency Window</div>
            <div className="chaos-slider-row">
              <label htmlFor="chaos-latency-min">Min</label>
              <input
                id="chaos-latency-min"
                type="range"
                min={0}
                max={MAX_CHAOS_LATENCY_MS}
                step={10}
                value={latencyMin}
                disabled={!enabled}
                onChange={(e) => updateChaosConfig({ latencyMin: Number(e.target.value) })}
              />
              <ValueField
                id="chaos-latency-min-input"
                value={latencyMin}
                min={0}
                max={MAX_CHAOS_LATENCY_MS}
                unit="ms"
                disabled={!enabled}
                onCommit={(next) => updateChaosConfig({ latencyMin: next })}
              />
            </div>
            <div className="chaos-slider-row">
              <label htmlFor="chaos-latency-max">Max</label>
              <input
                id="chaos-latency-max"
                type="range"
                min={0}
                max={MAX_CHAOS_LATENCY_MS}
                step={10}
                value={latencyMax}
                disabled={!enabled}
                onChange={(e) => updateChaosConfig({ latencyMax: Number(e.target.value) })}
              />
              <ValueField
                id="chaos-latency-max-input"
                value={latencyMax}
                min={0}
                max={MAX_CHAOS_LATENCY_MS}
                unit="ms"
                disabled={!enabled}
                onCommit={(next) => updateChaosConfig({ latencyMax: next })}
              />
            </div>
          </div>

          <div className="chaos-section">
            <div className="chaos-section-title">Error Rate Injector</div>
            {ERROR_STATUSES.map(({ status, label }) => (
              <div className="chaos-slider-row" key={status}>
                <label htmlFor={`chaos-rate-${status}`}>
                  <span className="chaos-status-code">{status}</span>
                  <span className="chaos-status-label">{label}</span>
                </label>
                <input
                  id={`chaos-rate-${status}`}
                  type="range"
                  min={0}
                  max={100}
                  step={1}
                  value={errorRates[status]}
                  disabled={!enabled}
                  onChange={(e) =>
                    updateChaosConfig({
                      errorRates: { [status]: Number(e.target.value) } as any
                    })
                  }
                />
                <ValueField
                  id={`chaos-rate-${status}-input`}
                  value={errorRates[status]}
                  min={0}
                  max={100}
                  unit="%"
                  disabled={!enabled}
                  onCommit={(next) =>
                    updateChaosConfig({ errorRates: { [status]: next } as any })
                  }
                />
              </div>
            ))}
            {totalErrorRate >= 100 && (
              <p className="chaos-warning">Every request will fail — combined rate is at 100%.</p>
            )}
          </div>

          <div className="chaos-actions">
            <button type="button" className="btn btn-secondary btn-sm" onClick={resetChaosConfig}>
              <RotateCcw size={12} />
              <span>Reset to defaults</span>
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
