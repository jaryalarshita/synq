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

describe('ChaosPanel — typed value entry', () => {
  it('shows an editable input beside each slider', async () => {
    const user = userEvent.setup()
    render(<ChaosPanel />)
    await expand(user)

    // Targeted by id: the slider and the number field share a value, so a
    // display-value lookup would match both.
    const minInput = document.getElementById('chaos-latency-min-input') as HTMLInputElement
    const maxInput = document.getElementById('chaos-latency-max-input') as HTMLInputElement
    expect(minInput.value).toBe(String(DEFAULT_CHAOS_CONFIG.latencyMin))
    expect(maxInput.value).toBe(String(DEFAULT_CHAOS_CONFIG.latencyMax))
  })

  it('commits a typed latency on Enter', async () => {
    const user = userEvent.setup()
    useSynqStore.setState({ chaosConfig: { ...DEFAULT_CHAOS_CONFIG, enabled: true } })
    render(<ChaosPanel />)
    await expand(user)

    const input = document.getElementById('chaos-latency-max-input') as HTMLInputElement
    await user.clear(input)
    await user.type(input, '1750{Enter}')

    expect(useSynqStore.getState().chaosConfig.latencyMax).toBe(1750)
  })

  it('commits a typed value on blur as well', async () => {
    const user = userEvent.setup()
    useSynqStore.setState({ chaosConfig: { ...DEFAULT_CHAOS_CONFIG, enabled: true } })
    render(<ChaosPanel />)
    await expand(user)

    const input = document.getElementById('chaos-latency-min-input') as HTMLInputElement
    await user.clear(input)
    await user.type(input, '120')
    await user.tab()

    expect(useSynqStore.getState().chaosConfig.latencyMin).toBe(120)
  })

  it('keeps the slider and the input in step', async () => {
    const user = userEvent.setup()
    useSynqStore.setState({ chaosConfig: { ...DEFAULT_CHAOS_CONFIG, enabled: true } })
    render(<ChaosPanel />)
    await expand(user)

    fireEvent.change(screen.getByLabelText('Max'), { target: { value: '3200' } })

    const input = document.getElementById('chaos-latency-max-input') as HTMLInputElement
    expect(input.value).toBe('3200')
  })

  it('reverts an unusable entry rather than writing NaN', async () => {
    const user = userEvent.setup()
    useSynqStore.setState({ chaosConfig: { ...DEFAULT_CHAOS_CONFIG, enabled: true } })
    render(<ChaosPanel />)
    await expand(user)

    const input = document.getElementById('chaos-latency-min-input') as HTMLInputElement
    await user.clear(input)
    await user.tab()

    expect(useSynqStore.getState().chaosConfig.latencyMin).toBe(DEFAULT_CHAOS_CONFIG.latencyMin)
    expect(input.value).toBe(String(DEFAULT_CHAOS_CONFIG.latencyMin))
  })

  it('clamps a typed value beyond the maximum', async () => {
    const user = userEvent.setup()
    useSynqStore.setState({ chaosConfig: { ...DEFAULT_CHAOS_CONFIG, enabled: true } })
    render(<ChaosPanel />)
    await expand(user)

    const input = document.getElementById('chaos-latency-max-input') as HTMLInputElement
    await user.clear(input)
    await user.type(input, '99999{Enter}')

    expect(useSynqStore.getState().chaosConfig.latencyMax).toBe(5000)
  })

  it('commits a typed error rate', async () => {
    const user = userEvent.setup()
    useSynqStore.setState({ chaosConfig: { ...DEFAULT_CHAOS_CONFIG, enabled: true } })
    render(<ChaosPanel />)
    await expand(user)

    const input = document.getElementById('chaos-rate-500-input') as HTMLInputElement
    await user.clear(input)
    await user.type(input, '42{Enter}')

    expect(useSynqStore.getState().chaosConfig.errorRates[500]).toBe(42)
  })
})
