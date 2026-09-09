import { describe, it, expect, vi } from 'vitest'
import { simulateApiRequest } from './mockApiServer'
import { DEFAULT_CHAOS_CONFIG } from '../store/useSynqStore'
import type { ChaosConfig, Entity } from '../store/useSynqStore'

const usersEntity: Entity = {
  id: 'entity-users',
  name: 'Users',
  fields: [
    { id: 'f-email', name: 'email', type: 'email' },
    { id: 'f-role', name: 'role', type: 'enum', options: ['admin', 'user'] },
    { id: 'f-age', name: 'age', type: 'number' }
  ]
}

const entities: Entity[] = [usersEntity]

const rows = [
  { id: 'u1', email: 'alice@example.com', role: 'admin', age: 30 },
  { id: 'u2', email: 'bob@example.com', role: 'user', age: 25 },
  { id: 'u3', email: 'carol@example.com', role: 'user', age: 40 }
]

const generatedData = { [usersEntity.id]: rows }

function noopAddRecord() {
  return vi.fn()
}

describe('simulateApiRequest — GET', () => {
  it('lists all records for a known entity', async () => {
    const res = await simulateApiRequest('GET', '/api/users', undefined, entities, generatedData, noopAddRecord())
    expect(res.status).toBe(200)
    expect(res.data).toHaveLength(3)
  })

  it('returns a single record by id', async () => {
    const res = await simulateApiRequest('GET', '/api/users/u2', undefined, entities, generatedData, noopAddRecord())
    expect(res.status).toBe(200)
    expect(res.data).toMatchObject({ id: 'u2', email: 'bob@example.com' })
  })

  it('returns 404 for an unknown record id', async () => {
    const res = await simulateApiRequest('GET', '/api/users/does-not-exist', undefined, entities, generatedData, noopAddRecord())
    expect(res.status).toBe(404)
  })

  it('returns 404 for an unknown entity', async () => {
    const res = await simulateApiRequest('GET', '/api/ghosts', undefined, entities, generatedData, noopAddRecord())
    expect(res.status).toBe(404)
  })

  it('returns 404 for a path that is not under /api', async () => {
    const res = await simulateApiRequest('GET', '/users', undefined, entities, generatedData, noopAddRecord())
    expect(res.status).toBe(404)
  })

  it('applies the global search query across all columns', async () => {
    const res = await simulateApiRequest('GET', '/api/users?search=carol', undefined, entities, generatedData, noopAddRecord())
    expect(res.status).toBe(200)
    expect(res.data).toHaveLength(1)
    expect(res.data[0].id).toBe('u3')
  })

  it('applies an exact column filter', async () => {
    const res = await simulateApiRequest('GET', '/api/users?role=admin', undefined, entities, generatedData, noopAddRecord())
    expect(res.status).toBe(200)
    expect(res.data).toHaveLength(1)
    expect(res.data[0].role).toBe('admin')
  })

  it('paginates with limit and page', async () => {
    const res = await simulateApiRequest('GET', '/api/users?limit=1&page=2', undefined, entities, generatedData, noopAddRecord())
    expect(res.status).toBe(200)
    expect(res.data).toHaveLength(1)
    expect(res.data[0].id).toBe('u2')
  })
})

describe('simulateApiRequest — POST', () => {
  it('creates a record and returns 201 with a new id', async () => {
    const addRecord = vi.fn()
    const body = JSON.stringify({ email: 'dave@example.com', role: 'user', age: 22 })

    const res = await simulateApiRequest('POST', '/api/users', body, entities, generatedData, addRecord)

    expect(res.status).toBe(201)
    expect(res.data.email).toBe('dave@example.com')
    expect(res.data.id).toBeTruthy()
    expect(res.data.id).not.toBe('u1')
    expect(addRecord).toHaveBeenCalledWith(usersEntity.id, res.data)
  })

  it('returns 400 for malformed JSON body', async () => {
    const res = await simulateApiRequest('POST', '/api/users', '{not json', entities, generatedData, noopAddRecord())
    expect(res.status).toBe(400)
  })

  it('returns 400 with validation details for an invalid email', async () => {
    const body = JSON.stringify({ email: 'not-an-email', role: 'user', age: 22 })
    const res = await simulateApiRequest('POST', '/api/users', body, entities, generatedData, noopAddRecord())
    expect(res.status).toBe(400)
    expect(res.data.details).toHaveProperty('email')
  })

  it('returns 400 when an enum value is not one of the configured options', async () => {
    const body = JSON.stringify({ email: 'e@example.com', role: 'superadmin', age: 22 })
    const res = await simulateApiRequest('POST', '/api/users', body, entities, generatedData, noopAddRecord())
    expect(res.status).toBe(400)
    expect(res.data.details).toHaveProperty('role')
  })

  it('returns 405 when POSTing to an individual record path', async () => {
    const res = await simulateApiRequest('POST', '/api/users/u1', '{}', entities, generatedData, noopAddRecord())
    expect(res.status).toBe(405)
  })
})

describe('simulateApiRequest — unsupported method', () => {
  it('returns 405 for a method other than GET/POST', async () => {
    const res = await simulateApiRequest('DELETE' as any, '/api/users', undefined, entities, generatedData, noopAddRecord())
    expect(res.status).toBe(405)
  })
})

describe('simulateApiRequest — chaos injection', () => {
  function chaos(overrides: Partial<ChaosConfig> = {}): ChaosConfig {
    return {
      ...DEFAULT_CHAOS_CONFIG,
      enabled: true,
      latencyMin: 0,
      latencyMax: 0,
      ...overrides
    }
  }

  // A fixed roll makes the outcome of the single chaos draw predictable.
  const rollOf = (value: number) => () => value

  it('never injects while chaos is disabled, whatever the rates say', async () => {
    const config = chaos({ enabled: false, errorRates: { 500: 100, 429: 100, 404: 100 } })

    const res = await simulateApiRequest('GET', '/api/users', undefined, entities, generatedData, noopAddRecord(), {
      chaos: config,
      random: rollOf(0)
    })

    expect(res.status).toBe(200)
    expect(res.injected).toBeUndefined()
  })

  it('never injects when every rate is zero', async () => {
    const res = await simulateApiRequest('GET', '/api/users', undefined, entities, generatedData, noopAddRecord(), {
      chaos: chaos(),
      random: rollOf(0)
    })

    expect(res.status).toBe(200)
  })

  it('always injects a 500 at a 100% failure rate', async () => {
    const res = await simulateApiRequest('GET', '/api/users', undefined, entities, generatedData, noopAddRecord(), {
      chaos: chaos({ errorRates: { 500: 100, 429: 0, 404: 0 } }),
      random: rollOf(0.99)
    })

    expect(res.status).toBe(500)
    expect(res.statusText).toBe('Internal Server Error')
    expect(res.injected).toBe(true)
    expect(res.data.injectedByChaos).toBe(true)
  })

  it('lays the rates end to end so each status owns its own slice', async () => {
    const config = chaos({ errorRates: { 500: 10, 429: 5, 404: 5 } })
    const statusFor = async (roll: number) =>
      (
        await simulateApiRequest('GET', '/api/users', undefined, entities, generatedData, noopAddRecord(), {
          chaos: config,
          random: () => roll
        })
      ).status

    expect(await statusFor(0.05)).toBe(500) // roll 5  -> within 0-10
    expect(await statusFor(0.12)).toBe(429) // roll 12 -> within 10-15
    expect(await statusFor(0.17)).toBe(404) // roll 17 -> within 15-20
    expect(await statusFor(0.5)).toBe(200) // roll 50 -> no injection
  })

  it('short-circuits before routing, so even a valid POST is not persisted', async () => {
    const addRecord = vi.fn()

    const res = await simulateApiRequest(
      'POST',
      '/api/users',
      JSON.stringify({ email: 'e@example.com', role: 'admin', age: 22 }),
      entities,
      generatedData,
      addRecord,
      { chaos: chaos({ errorRates: { 500: 100, 429: 0, 404: 0 } }), random: rollOf(0) }
    )

    expect(res.status).toBe(500)
    expect(addRecord).not.toHaveBeenCalled()
  })

  it('samples the configured latency window', async () => {
    const res = await simulateApiRequest('GET', '/api/users', undefined, entities, generatedData, noopAddRecord(), {
      chaos: chaos({ latencyMin: 60, latencyMax: 90 }),
      random: rollOf(0)
    })

    // rng of 0 picks the floor of the range; timing includes routing overhead.
    expect(res.timeMs).toBeGreaterThanOrEqual(55)
    expect(res.status).toBe(200)
  })
})
