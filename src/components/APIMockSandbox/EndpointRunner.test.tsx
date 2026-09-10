import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import EndpointRunner from './EndpointRunner'
import { useSynqStore, DEFAULT_CHAOS_CONFIG } from '../../store/useSynqStore'
import type { Entity } from '../../store/useSynqStore'

const users: Entity = {
  id: 'e-users',
  name: 'Users',
  fields: [
    { id: 'f1', name: 'email', type: 'email' },
    { id: 'f2', name: 'role', type: 'enum', options: ['admin', 'user'] }
  ]
}

const userRows = [
  { id: 'u1', email: 'ada@example.com', role: 'admin' },
  { id: 'u2', email: 'grace@example.com', role: 'user' }
]

beforeEach(() => {
  vi.clearAllMocks()
  Object.defineProperty(navigator, 'clipboard', {
    value: { writeText: vi.fn() },
    configurable: true
  })
  useSynqStore.setState({
    entities: [users],
    generatedData: { [users.id]: userRows },
    chaosConfig: DEFAULT_CHAOS_CONFIG
  })
})

describe('EndpointRunner routes', () => {
  it('shows the empty state when no entities are defined', () => {
    useSynqStore.setState({ entities: [], generatedData: {} })
    render(<EndpointRunner />)

    expect(screen.getByText('No Entities Defined')).toBeInTheDocument()
  })

  it('lists GET list, GET by id, and POST routes for each entity', () => {
    render(<EndpointRunner />)

    // Matched as buttons so the URL bar's method badge isn't counted as a route.
    expect(screen.getByRole('button', { name: /^GET\s*\/api\/users$/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /^GET\s*\/api\/users\/:id$/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /^POST\s*\/api\/users$/ })).toBeInTheDocument()
  })

  it('auto-selects the first route and prefills its path', () => {
    render(<EndpointRunner />)

    expect(screen.getByDisplayValue('/api/users')).toBeInTheDocument()
  })

  it('substitutes a real record id when the by-id route is selected', async () => {
    const user = userEvent.setup()
    render(<EndpointRunner />)

    await user.click(screen.getByText('/api/users/:id'))

    expect(screen.getByDisplayValue('/api/users/u1')).toBeInTheDocument()
  })

  it('prefills a JSON body template for POST routes', async () => {
    const user = userEvent.setup()
    render(<EndpointRunner />)

    await user.click(screen.getByText('POST'))

    const textarea = screen.getByLabelText('JSON Request Body') as HTMLTextAreaElement
    const parsed = JSON.parse(textarea.value)
    expect(parsed).toHaveProperty('email')
    expect(parsed.role).toBe('admin') // first enum option
  })

  it('disables the by-id route until records exist', () => {
    useSynqStore.setState({ entities: [users], generatedData: {} })
    render(<EndpointRunner />)

    expect(screen.getByText('/api/users/:id').closest('button')).toBeDisabled()
  })
})

describe('EndpointRunner request execution', () => {
  it('returns 200 with the record list and a timing badge for a GET', async () => {
    const user = userEvent.setup()
    render(<EndpointRunner />)

    await user.click(screen.getByText('Send'))

    expect(await screen.findByText('200 OK', undefined, { timeout: 3000 })).toBeInTheDocument()
    expect(screen.getByText(/^\d+ ms$/)).toBeInTheDocument()
    expect(screen.getByText(/ada@example\.com/)).toBeInTheDocument()
  })

  it('returns 404 for an unknown entity path', async () => {
    const user = userEvent.setup()
    render(<EndpointRunner />)

    const pathInput = screen.getByDisplayValue('/api/users')
    await user.clear(pathInput)
    await user.type(pathInput, '/api/ghosts')
    await user.click(screen.getByText('Send'))

    expect(await screen.findByText('404 Not Found', undefined, { timeout: 3000 })).toBeInTheDocument()
  })

  it('rejects a malformed POST payload before sending', async () => {
    const user = userEvent.setup()
    render(<EndpointRunner />)

    await user.click(screen.getByText('POST'))
    const textarea = screen.getByLabelText('JSON Request Body')
    await user.clear(textarea)
    await user.type(textarea, '{{not json') // '{{' types a literal '{' in user-event
    await user.click(screen.getByText('Send'))

    expect(await screen.findByText('Malformed JSON payload body')).toBeInTheDocument()
  })

  it('surfaces an injected chaos failure instead of the real response', async () => {
    const user = userEvent.setup()
    // 100% 500-rate means the roll can only land on the injected failure.
    useSynqStore.setState({
      chaosConfig: {
        enabled: true,
        latencyMin: 0,
        latencyMax: 0,
        errorRates: { 500: 100, 429: 0, 404: 0 }
      }
    })
    render(<EndpointRunner />)

    await user.click(screen.getByText('Send'))

    expect(
      await screen.findByText('500 Internal Server Error', undefined, { timeout: 3000 })
    ).toBeInTheDocument()
    expect(screen.getByText(/injectedByChaos/)).toBeInTheDocument()
  })

  it('persists a valid POST into the store and reports 201', async () => {
    const user = userEvent.setup()
    render(<EndpointRunner />)

    await user.click(screen.getByText('POST'))
    await user.click(screen.getByText('Send'))

    expect(await screen.findByText('201 Created', undefined, { timeout: 3000 })).toBeInTheDocument()
    expect(useSynqStore.getState().generatedData[users.id]).toHaveLength(3)
  })
})
