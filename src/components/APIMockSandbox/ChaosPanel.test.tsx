import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import ChaosPanel from './ChaosPanel'
import { useSynqStore, DEFAULT_CHAOS_CONFIG } from '../../store/useSynqStore'

beforeEach(() => {
  useSynqStore.setState({ chaosConfig: DEFAULT_CHAOS_CONFIG })
})

async function expand(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByText('Chaos Studio'))
}

describe('ChaosPanel', () => {
  it('starts collapsed and switched off', () => {
    render(<ChaosPanel />)

    expect(screen.getByText('Off')).toBeInTheDocument()
    expect(screen.queryByLabelText('Min')).not.toBeInTheDocument()
  })

  it('reveals the latency and error-rate controls when expanded', async () => {
    const user = userEvent.setup()
    render(<ChaosPanel />)

    await expand(user)

    expect(screen.getByLabelText('Min')).toBeInTheDocument()
    expect(screen.getByLabelText('Max')).toBeInTheDocument()
    expect(screen.getByLabelText(/500/)).toBeInTheDocument()
    expect(screen.getByLabelText(/429/)).toBeInTheDocument()
    expect(screen.getByLabelText(/404/)).toBeInTheDocument()
  })

  it('enables chaos in the store via the switch', async () => {
    const user = userEvent.setup()
    render(<ChaosPanel />)

    await user.click(screen.getByRole('checkbox'))

    expect(useSynqStore.getState().chaosConfig.enabled).toBe(true)
    expect(screen.getByText('On')).toBeInTheDocument()
  })

  it('keeps the sliders disabled until chaos is switched on', async () => {
    const user = userEvent.setup()
    render(<ChaosPanel />)
    await expand(user)

    expect(screen.getByLabelText('Min')).toBeDisabled()

    await user.click(screen.getByRole('checkbox'))

    expect(screen.getByLabelText('Min')).toBeEnabled()
  })

  it('writes a latency change through to the store', async () => {
    const user = userEvent.setup()
    useSynqStore.setState({ chaosConfig: { ...DEFAULT_CHAOS_CONFIG, enabled: true } })
    render(<ChaosPanel />)
    await expand(user)

    // Range inputs are dragged, not typed into — fireEvent sets the value directly.
    fireEvent.change(screen.getByLabelText('Max'), { target: { value: '2500' } })

    expect(useSynqStore.getState().chaosConfig.latencyMax).toBe(2500)
  })

  it('writes an error-rate change through to the store', async () => {
    const user = userEvent.setup()
    useSynqStore.setState({ chaosConfig: { ...DEFAULT_CHAOS_CONFIG, enabled: true } })
    render(<ChaosPanel />)
    await expand(user)

    fireEvent.change(screen.getByLabelText(/429/), { target: { value: '35' } })

    expect(useSynqStore.getState().chaosConfig.errorRates).toEqual({ 500: 0, 429: 35, 404: 0 })
  })

  it('summarises the active configuration in the header', async () => {
    const user = userEvent.setup()
    useSynqStore.setState({
      chaosConfig: {
        enabled: true,
        latencyMin: 100,
        latencyMax: 900,
        errorRates: { 500: 10, 429: 5, 404: 0 }
      }
    })
    render(<ChaosPanel />)

    expect(screen.getByText('100–900 ms · 15% fail')).toBeInTheDocument()

    await expand(user)
    expect(screen.queryByText(/Every request will fail/)).not.toBeInTheDocument()
  })

  it('warns when the combined failure rate reaches 100%', async () => {
    const user = userEvent.setup()
    useSynqStore.setState({
      chaosConfig: {
        enabled: true,
        latencyMin: 0,
        latencyMax: 0,
        errorRates: { 500: 60, 429: 40, 404: 0 }
      }
    })
    render(<ChaosPanel />)
    await expand(user)

    expect(screen.getByText(/Every request will fail/)).toBeInTheDocument()
  })

  it('restores defaults from the reset button', async () => {
    const user = userEvent.setup()
    useSynqStore.setState({
      chaosConfig: { enabled: true, latencyMin: 800, latencyMax: 4000, errorRates: { 500: 50, 429: 0, 404: 0 } }
    })
    render(<ChaosPanel />)
    await expand(user)

    await user.click(screen.getByText('Reset to defaults'))

    expect(useSynqStore.getState().chaosConfig).toEqual(DEFAULT_CHAOS_CONFIG)
  })
})
