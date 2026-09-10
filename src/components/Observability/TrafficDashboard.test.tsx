import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import TrafficDashboard from './TrafficDashboard'
import { useSynqStore } from '../../store/useSynqStore'
import type { RequestLogEntry } from '../../store/useSynqStore'

let seq = 0
function entry(overrides: Partial<RequestLogEntry> = {}): RequestLogEntry {
  seq++
  return {
    id: `r${seq}`,
    timestamp: 1_700_000_000_000 + seq * 1000,
    method: 'GET',
    path: '/api/users',
    status: 200,
    timeMs: 120,
    injected: false,
    ...overrides
  }
}

function seed(entries: RequestLogEntry[]) {
  useSynqStore.setState({ requestLog: entries })
}

beforeEach(() => {
  useSynqStore.setState({ requestLog: [] })
})

/** Reads the value rendered inside the stat tile with the given label. */
function statValue(label: string): string {
  const tile = screen.getByText(label).closest('.stat-tile') as HTMLElement
  return within(tile).getByText((_, el) => el?.className === 'stat-value').textContent ?? ''
}

describe('TrafficDashboard empty state', () => {
  it('explains how to produce traffic when nothing is logged', () => {
    render(<TrafficDashboard />)

    expect(screen.getByText('No Traffic Recorded')).toBeInTheDocument()
    expect(screen.getByText(/API Mock Sandbox/)).toBeInTheDocument()
  })

  it('hides the clear button until there is something to clear', () => {
    render(<TrafficDashboard />)

    expect(screen.queryByRole('button', { name: /Clear/ })).not.toBeInTheDocument()
  })
})

describe('TrafficDashboard summary tiles', () => {
  it('counts the recorded requests', () => {
    seed([entry(), entry(), entry()])
    render(<TrafficDashboard />)

    expect(statValue('Requests')).toBe('3')
  })

  it('reports the success rate and failure count', () => {
    seed([entry({ status: 200 }), entry({ status: 200 }), entry({ status: 500 }), entry({ status: 404 })])
    render(<TrafficDashboard />)

    expect(statValue('Success Rate')).toBe('50%')
    expect(screen.getByText('2 failed')).toBeInTheDocument()
  })

  it('averages latency and shows the observed range', () => {
    seed([entry({ timeMs: 100 }), entry({ timeMs: 300 })])
    render(<TrafficDashboard />)

    expect(statValue('Avg Latency')).toBe('200 ms')
    expect(screen.getByText('100–300 ms')).toBeInTheDocument()
  })

  it('counts chaos-injected responses separately', () => {
    seed([entry(), entry({ status: 500, injected: true }), entry({ status: 429, injected: true })])
    render(<TrafficDashboard />)

    expect(statValue('Chaos Injected')).toBe('2')
  })
})

describe('TrafficDashboard charts', () => {
  it('renders all three charts once traffic exists', () => {
    seed([entry()])
    render(<TrafficDashboard />)

    expect(screen.getByText('Request Throughput')).toBeInTheDocument()
    expect(screen.getByText('Latency Distribution')).toBeInTheDocument()
    expect(screen.getByText('Status Codes')).toBeInTheDocument()
  })

  it('draws a throughput path rather than loading a chart library', () => {
    seed([entry(), entry(), entry()])
    const { container } = render(<TrafficDashboard />)

    const line = container.querySelector('.throughput-line')
    expect(line).toBeInTheDocument()
    expect(line?.getAttribute('d')).toMatch(/^M[\d.]+,[\d.]+/)
  })

  it('summarises status families in the legend', () => {
    seed([entry({ status: 200 }), entry({ status: 200 }), entry({ status: 500 }), entry({ status: 500 })])
    render(<TrafficDashboard />)

    expect(screen.getByText('2xx')).toBeInTheDocument()
    expect(screen.getByText('5xx')).toBeInTheDocument()
    expect(screen.getAllByText('2 · 50%')).toHaveLength(2)
  })

  it('puts a slow request in a high latency band', () => {
    seed([entry({ timeMs: 3000 })])
    const { container } = render(<TrafficDashboard />)

    const columns = Array.from(container.querySelectorAll('.histogram-column'))
    const overflow = columns.at(-1) as HTMLElement
    expect(within(overflow).getByText('1')).toBeInTheDocument()
    expect(within(overflow).getByText('2500+')).toBeInTheDocument()
  })
})

describe('TrafficDashboard clearing', () => {
  it('empties the log and returns to the empty state', async () => {
    const user = userEvent.setup()
    seed([entry(), entry()])
    render(<TrafficDashboard />)

    await user.click(screen.getByRole('button', { name: /Clear/ }))

    expect(useSynqStore.getState().requestLog).toEqual([])
    expect(screen.getByText('No Traffic Recorded')).toBeInTheDocument()
  })
})
