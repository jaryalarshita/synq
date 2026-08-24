import { describe, it, expect, vi } from 'vitest'
import { simulateApiRequest } from './mockApiServer'
import type { Entity } from '../store/useSynqStore'

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
