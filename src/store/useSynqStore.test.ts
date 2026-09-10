import { describe, it, expect, beforeEach } from 'vitest'
import {
  useSynqStore,
  DEFAULT_CHAOS_CONFIG,
  MAX_CHAOS_LATENCY_MS,
  MAX_REQUEST_LOG_ENTRIES
} from './useSynqStore'

// Reset the store (it's a module-level singleton) before every test so
// state from one test can't leak into the next.
beforeEach(() => {
  useSynqStore.setState({
    entities: [],
    generatedData: {},
    isGenerating: false,
    chaosConfig: DEFAULT_CHAOS_CONFIG,
    requestLog: [],
    activeTab: 'schema'
  })
})

describe('useSynqStore entity/field CRUD', () => {
  it('adds an entity with an empty field list', () => {
    useSynqStore.getState().addEntity('Users')

    const { entities } = useSynqStore.getState()
    expect(entities).toHaveLength(1)
    expect(entities[0]).toMatchObject({ name: 'Users', fields: [] })
  })

  it('renames an entity by id', () => {
    useSynqStore.getState().addEntity('Users')
    const id = useSynqStore.getState().entities[0].id

    useSynqStore.getState().updateEntityName(id, 'Customers')

    expect(useSynqStore.getState().entities[0].name).toBe('Customers')
  })

  it('adds, updates, and deletes a field on an entity', () => {
    useSynqStore.getState().addEntity('Users')
    const entityId = useSynqStore.getState().entities[0].id

    useSynqStore.getState().addField(entityId, { name: 'email', type: 'email' })
    let field = useSynqStore.getState().entities[0].fields[0]
    expect(field.name).toBe('email')

    useSynqStore.getState().updateField(entityId, field.id, { name: 'workEmail' })
    field = useSynqStore.getState().entities[0].fields[0]
    expect(field.name).toBe('workEmail')

    useSynqStore.getState().deleteField(entityId, field.id)
    expect(useSynqStore.getState().entities[0].fields).toHaveLength(0)
  })
})

describe('useSynqStore deleteEntity', () => {
  it('removes the entity and its own generated rows', () => {
    useSynqStore.getState().addEntity('Users')
    const usersId = useSynqStore.getState().entities[0].id
    useSynqStore.getState().setGeneratedData({ [usersId]: [{ id: 'u1' }] })

    useSynqStore.getState().deleteEntity(usersId)

    const { entities, generatedData } = useSynqStore.getState()
    expect(entities).toHaveLength(0)
    expect(generatedData[usersId]).toBeUndefined()
  })

  it('drops the dangling foreign-key field from dependent entities', () => {
    useSynqStore.getState().addEntity('Users')
    const usersId = useSynqStore.getState().entities[0].id
    useSynqStore.getState().addEntity('Orders')
    const ordersId = useSynqStore.getState().entities[1].id
    useSynqStore.getState().addField(ordersId, {
      name: 'userId',
      type: 'foreign_key',
      referenceEntityId: usersId
    })

    useSynqStore.getState().deleteEntity(usersId)

    const orders = useSynqStore.getState().entities.find((e) => e.id === ordersId)
    expect(orders?.fields).toHaveLength(0)
  })

  it('strips the orphaned foreign-key value from already generated rows of dependent entities', () => {
    useSynqStore.getState().addEntity('Users')
    const usersId = useSynqStore.getState().entities[0].id
    useSynqStore.getState().addEntity('Orders')
    const ordersId = useSynqStore.getState().entities[1].id
    useSynqStore.getState().addField(ordersId, {
      name: 'userId',
      type: 'foreign_key',
      referenceEntityId: usersId
    })

    // Simulate data that was generated before the Users entity is deleted:
    // Orders rows still carry a userId pointing at a User record.
    useSynqStore.getState().setGeneratedData({
      [usersId]: [{ id: 'u1' }],
      [ordersId]: [{ id: 'o1', userId: 'u1', total: 42 }]
    })

    useSynqStore.getState().deleteEntity(usersId)

    const orderRows = useSynqStore.getState().generatedData[ordersId]
    expect(orderRows).toEqual([{ id: 'o1', total: 42 }])
    expect(orderRows[0]).not.toHaveProperty('userId')
  })

  it('leaves unrelated entities and their generated data untouched', () => {
    useSynqStore.getState().addEntity('Users')
    const usersId = useSynqStore.getState().entities[0].id
    useSynqStore.getState().addEntity('Products')
    const productsId = useSynqStore.getState().entities[1].id
    useSynqStore.getState().setGeneratedData({
      [usersId]: [{ id: 'u1' }],
      [productsId]: [{ id: 'p1', name: 'Widget' }]
    })

    useSynqStore.getState().deleteEntity(usersId)

    expect(useSynqStore.getState().generatedData[productsId]).toEqual([{ id: 'p1', name: 'Widget' }])
  })
})

describe('useSynqStore chaos config', () => {
  it('starts disabled with the original latency feel and no error rates', () => {
    const { chaosConfig } = useSynqStore.getState()

    expect(chaosConfig).toEqual(DEFAULT_CHAOS_CONFIG)
    expect(chaosConfig.enabled).toBe(false)
  })

  it('merges a partial patch without dropping the other settings', () => {
    useSynqStore.getState().updateChaosConfig({ enabled: true })

    const { chaosConfig } = useSynqStore.getState()
    expect(chaosConfig.enabled).toBe(true)
    expect(chaosConfig.latencyMin).toBe(DEFAULT_CHAOS_CONFIG.latencyMin)
  })

  it('merges error rates individually rather than replacing the whole map', () => {
    useSynqStore.getState().updateChaosConfig({ errorRates: { 500: 25 } as any })

    expect(useSynqStore.getState().chaosConfig.errorRates).toEqual({ 500: 25, 429: 0, 404: 0 })
  })

  it('clamps latency to the supported window', () => {
    useSynqStore.getState().updateChaosConfig({ latencyMin: -50, latencyMax: 99999 })

    const { chaosConfig } = useSynqStore.getState()
    expect(chaosConfig.latencyMin).toBe(0)
    expect(chaosConfig.latencyMax).toBe(MAX_CHAOS_LATENCY_MS)
  })

  it('pushes the max up when the min is dragged past it', () => {
    useSynqStore.getState().updateChaosConfig({ latencyMin: 1000, latencyMax: 500 })
    useSynqStore.getState().updateChaosConfig({ latencyMin: 2000 })

    const { chaosConfig } = useSynqStore.getState()
    expect(chaosConfig.latencyMin).toBe(2000)
    expect(chaosConfig.latencyMax).toBe(2000)
  })

  it('pulls the min down when the max is dragged below it', () => {
    useSynqStore.getState().updateChaosConfig({ latencyMin: 3000, latencyMax: 4000 })
    useSynqStore.getState().updateChaosConfig({ latencyMax: 1000 })

    const { chaosConfig } = useSynqStore.getState()
    expect(chaosConfig.latencyMin).toBe(1000)
    expect(chaosConfig.latencyMax).toBe(1000)
  })

  it('clamps error rates to 0-100', () => {
    useSynqStore.getState().updateChaosConfig({ errorRates: { 500: 150, 429: -10, 404: 50 } })

    expect(useSynqStore.getState().chaosConfig.errorRates).toEqual({ 500: 100, 429: 0, 404: 50 })
  })

  it('restores the defaults on reset', () => {
    useSynqStore.getState().updateChaosConfig({ enabled: true, latencyMin: 900, latencyMax: 4000 })

    useSynqStore.getState().resetChaosConfig()

    expect(useSynqStore.getState().chaosConfig).toEqual(DEFAULT_CHAOS_CONFIG)
  })
})

describe('useSynqStore addRecord', () => {
  it('appends a record to an existing entity dataset', () => {
    useSynqStore.getState().addEntity('Users')
    const usersId = useSynqStore.getState().entities[0].id
    useSynqStore.getState().setGeneratedData({ [usersId]: [{ id: 'u1' }] })

    useSynqStore.getState().addRecord(usersId, { id: 'u2' })

    expect(useSynqStore.getState().generatedData[usersId]).toEqual([{ id: 'u1' }, { id: 'u2' }])
  })

  it('creates the dataset when the entity had no rows yet', () => {
    useSynqStore.getState().addEntity('Users')
    const usersId = useSynqStore.getState().entities[0].id

    useSynqStore.getState().addRecord(usersId, { id: 'u1' })

    expect(useSynqStore.getState().generatedData[usersId]).toEqual([{ id: 'u1' }])
  })
})

describe('useSynqStore request log', () => {
  const sample = { method: 'GET' as const, path: '/api/users', status: 200, timeMs: 42, injected: false }

  it('starts empty', () => {
    expect(useSynqStore.getState().requestLog).toEqual([])
  })

  it('stamps each entry with an id and timestamp', () => {
    useSynqStore.getState().logRequest(sample)

    const [logged] = useSynqStore.getState().requestLog
    expect(logged).toMatchObject(sample)
    expect(logged.id).toBeTruthy()
    expect(logged.timestamp).toBeGreaterThan(0)
  })

  it('appends in chronological order', () => {
    useSynqStore.getState().logRequest({ ...sample, path: '/api/first' })
    useSynqStore.getState().logRequest({ ...sample, path: '/api/second' })

    expect(useSynqStore.getState().requestLog.map((e) => e.path)).toEqual([
      '/api/first',
      '/api/second'
    ])
  })

  it('records an injected chaos failure distinctly', () => {
    useSynqStore.getState().logRequest({ ...sample, status: 500, injected: true })

    expect(useSynqStore.getState().requestLog[0]).toMatchObject({ status: 500, injected: true })
  })

  it('caps the log, dropping the oldest entries first', () => {
    for (let i = 0; i < MAX_REQUEST_LOG_ENTRIES + 25; i++) {
      useSynqStore.getState().logRequest({ ...sample, path: `/api/r${i}` })
    }

    const log = useSynqStore.getState().requestLog
    expect(log).toHaveLength(MAX_REQUEST_LOG_ENTRIES)
    // The first 25 should have been evicted.
    expect(log[0].path).toBe('/api/r25')
    expect(log.at(-1)?.path).toBe(`/api/r${MAX_REQUEST_LOG_ENTRIES + 24}`)
  })

  it('empties the log on clear', () => {
    useSynqStore.getState().logRequest(sample)

    useSynqStore.getState().clearRequestLog()

    expect(useSynqStore.getState().requestLog).toEqual([])
  })
})

describe('useSynqStore active tab', () => {
  it('starts on the schema builder', () => {
    expect(useSynqStore.getState().activeTab).toBe('schema')
  })

  it('remembers the selected tab', () => {
    useSynqStore.getState().setActiveTab('observability')

    expect(useSynqStore.getState().activeTab).toBe('observability')
  })

  it('is included in the persisted slice so a reload restores it', () => {
    useSynqStore.getState().setActiveTab('api')

    const persisted = JSON.parse(localStorage.getItem('synq-storage') || '{}')
    expect(persisted.state.activeTab).toBe('api')
  })
})
